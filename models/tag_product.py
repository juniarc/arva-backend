from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship



class TagProductAssociation(db.Model):
    __tablename__ = "tag_products_association"
    tag_id = db.Column(db.Integer, ForeignKey('tags.tag_id', ondelete='CASCADE'), primary_key=True, nullable=False)
    product_id = db.Column(db.Integer, ForeignKey('products.product_id', ondelete='CASCADE'), primary_key=True, nullable=False)
    

    #relasi ke model product dan tag
    product = relationship("Product", back_populates="tag_product", lazy=True)
    tag = relationship("Tag", back_populates="product_tag", lazy=True)    


    def __repr__(self):
        return f'<TagProductAssociation {self.tag_id} {self.product_id}>'

    def to_dict(self):
        return {
            'tag_id': self.tag_id,
            'product_id': self.product_id
        }